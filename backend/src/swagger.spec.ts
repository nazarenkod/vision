import { SwaggerModule } from '@nestjs/swagger';
import { setupSwagger } from './swagger';

describe('setupSwagger', () => {
  it('names the API documentation Vision', () => {
    const create = jest.spyOn(SwaggerModule, 'createDocument').mockReturnValue({} as never);
    jest.spyOn(SwaggerModule, 'setup').mockImplementation(() => undefined);

    setupSwagger({} as never);

    expect(create.mock.calls[0][1].info.title).toBe('Vision');
  });
});
