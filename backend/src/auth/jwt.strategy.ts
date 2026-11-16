import { ExtractJwt, Strategy, VerifiedCallback } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { JwtPayload } from './jwt-payload.model';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  // a signed-out sign-in, an ended session or a gone account opens nothing (052)
  async validate(payload: JwtPayload & { iat?: number }, done: VerifiedCallback) {
    const found = await this.authService.userForToken(payload);
    if ('problem' in found) {
      return done(new HttpException({}, HttpStatus.UNAUTHORIZED), false);
    }
    return done(null, found.user, payload.expire);
  }
}
