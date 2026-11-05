import { User } from '@prisma/client';
import axios from 'axios'
import { UserLoginRequestDto } from '../src/users/dto/user-login-request.dto';
import { UserLoginResponseDto } from '../src/users/dto/user-login-response.dto';
import { randomUUID } from 'crypto';

axios.defaults.baseURL = 'http://localhost:4200';

let user: Partial<User> = {
    email: `${randomUUID()}@example.com`,
    password: '123456',
    firstName: 'fName',
    lastName: 'lName',
    role: 'guest',
};
// the seeded admin (prisma/seed.ts) creates accounts: nobody signs up (035)
const admin: UserLoginRequestDto = {
    email: process.env.DEFAULT_USER_EMAIL || 'admin@vision.local',
    password: process.env.DEFAULT_USER_PASSWORD || '123456',
}
const loginData: UserLoginRequestDto = {
    email: user.email,
    password: user.password,
}

describe('Acceptance', () => {

    test('An admin creates an account and it signs in', async () => {
        const { data } = await axios.post<UserLoginResponseDto>('/users/login', admin)
        await axios.post<User>('/users', user, { headers: { Authorization: `Bearer ${data.token}` } });

        const response = await axios.post<UserLoginResponseDto>('/users/login', loginData)

        expect(response.status).toBe(201)
        expect(response.data.token).toBeDefined()
    })
})