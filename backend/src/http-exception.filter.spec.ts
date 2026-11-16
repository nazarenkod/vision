import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const answer = (exception: unknown, url = '/projects/x') => {
  const json = jest.fn();
  const response = { status: jest.fn(() => ({ json })) };
  const host = {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', url }) }),
  };
  new HttpExceptionFilter().catch(exception, host as never);
  return { status: (response.status.mock.calls[0] as unknown[])[0], body: json.mock.calls[0][0] };
};

describe('HttpExceptionFilter', () => {
  it('answers an error with its code, message and path only', () => {
    expect(answer(new NotFoundException('Not found'))).toEqual({
      status: 404,
      body: { statusCode: 404, message: 'Not found', path: '/projects/x' },
    });
    // nothing of how the server is built: no stack, no exception, no text of an unexpected error
    const crash = answer(new Error('connect ECONNREFUSED 10.0.0.5:5432 at PrismaClient.query'));
    expect(crash).toEqual({
      status: 500,
      body: { statusCode: 500, message: 'Internal server error', path: '/projects/x' },
    });
    expect(JSON.stringify(crash.body)).not.toMatch(/stack|ECONNREFUSED|Prisma/);
  });

  it('keeps what the person needs: validation, permission, a settings conflict', () => {
    expect(answer(new BadRequestException(['name must be a string', 'id must be a UUID'])).body.message).toBe(
      'name must be a string; id must be a UUID'
    );
    expect(answer(new ForbiddenException('Forbidden resource')).body.message).toBe('You do not have permission to perform this operation.');
    expect(answer(new ConflictException({ message: 'Someone changed these settings', fields: ['Jira'] })).body).toEqual(
      {
        statusCode: 409,
        message: 'Someone changed these settings',
        path: '/projects/x',
        fields: ['Jira'],
      }
    );
    expect(
      answer(new Error('Unique constraint failed on the fields: (`name`) in project.create()')).body
    ).toMatchObject({
      statusCode: 400,
      message: 'Project exists with this name.',
    });
  });
});
