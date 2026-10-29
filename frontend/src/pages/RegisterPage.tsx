import React from "react";
import RegisterForm from "../components/RegisterForm";
import { AuthLayout } from "../components/AuthLayout";
import { useT } from "../i18n";

const RegisterPage = () => {
  const { t } = useT();
  return (
    <AuthLayout title={t("auth.createTitle")}>
      <RegisterForm />
    </AuthLayout>
  );
};

export default RegisterPage;
