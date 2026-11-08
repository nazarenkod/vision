export interface JwtPayload {
  email: string;
  // the session of this sign-in (052); absent on tokens issued before it
  sid?: string;
  expire?: Date;
}
