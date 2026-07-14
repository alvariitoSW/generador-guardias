import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PreferencesPage } from "./pages/resident/PreferencesPage";
import { VacationsPage } from "./pages/resident/VacationsPage";
import { MySchedulePage } from "./pages/resident/MySchedulePage";
import { SwapsPage } from "./pages/resident/SwapsPage";
import { ResidentsPage } from "./pages/admin/ResidentsPage";
import { ScheduleAdminPage } from "./pages/admin/ScheduleAdminPage";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin/cuadrante" : "/mi-cuadrante"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomeRedirect />} />
          <Route
            path="/mi-cuadrante"
            element={
              <ProtectedRoute role="RESIDENT">
                <MySchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/preferencias"
            element={
              <ProtectedRoute role="RESIDENT">
                <PreferencesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vacaciones"
            element={
              <ProtectedRoute role="RESIDENT">
                <VacationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cambios"
            element={
              <ProtectedRoute role="RESIDENT">
                <SwapsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/residentes"
            element={
              <ProtectedRoute role="ADMIN">
                <ResidentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cuadrante"
            element={
              <ProtectedRoute role="ADMIN">
                <ScheduleAdminPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
