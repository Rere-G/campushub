import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Services from "./pages/Services";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import Gate from "./components/Gate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/Home" element={<Gate><Home /></Gate>} />
      <Route path="/marketplace" element={<Gate><Marketplace /></Gate>} />
      <Route path="/services" element={<Gate><Services /></Gate>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Gate><Dashboard /></Gate>} />
      <Route path="/Profile" element={<Gate allowUnapproved><Profile /></Gate>} />
      <Route path="/admin" element={<Gate><Admin /></Gate>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}