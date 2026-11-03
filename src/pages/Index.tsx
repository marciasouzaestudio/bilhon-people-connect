import { Navigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";

const Index = () => {
  const { isConfigured } = useApp();
  return <Navigate to={isConfigured ? "/dashboard" : "/setup"} replace />;
};

export default Index;
