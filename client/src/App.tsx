import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import ForgotPassword from "./pages/ForgotPassword.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import VerifyEmail from "./pages/VerifyEmail.tsx";
import Home from "./pages/Home.tsx";
import Login from "./pages/Login.tsx";
import CollectivesList from "./pages/CollectivesList.tsx";
import CollectiveNew from "./pages/CollectiveNew.tsx";
import CollectiveJoin from "./pages/CollectiveJoin.tsx";
import CollectiveEdit from "./pages/CollectiveEdit.tsx";
import CollectiveManageMembersList from "./pages/CollectiveManageMembersList.tsx";
import CollectiveManageMember from "./pages/CollectiveManageMember.tsx";
import CollectiveDetail from "./pages/CollectiveDetail.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/collectives" element={<CollectivesList />} />
      <Route path="/collectives/new" element={<CollectiveNew />} />
      <Route path="/collectives/:collectiveId/join" element={<CollectiveJoin />} />
      <Route path="/collectives/:collectiveId/edit" element={<CollectiveEdit />} />
      <Route
        path="/collectives/:collectiveId/members/manage/:userId"
        element={<CollectiveManageMember />}
      />
      <Route
        path="/collectives/:collectiveId/members/manage"
        element={<CollectiveManageMembersList />}
      />
      <Route path="/collectives/:collectiveId" element={<CollectiveDetail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
