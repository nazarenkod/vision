import React from "react";
import RegisterForm from "../components/RegisterForm";
import { AuthLayout } from "../components/AuthLayout";

const RegisterPage = () => (
  <AuthLayout title="Create an account">
    <RegisterForm />
  </AuthLayout>
);

export default RegisterPage;
