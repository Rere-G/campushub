import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Services from "./pages/Services";
import CreateService from "./pages/CreateService";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import CreateListing from "./pages/CreateListing";
import Gate from "./components/Gate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/Home" element={<Gate><Home /></Gate>} />
      <Route path="/marketplace" element={<Gate><Marketplace /></Gate>} />
      <Route path="/marketplace/new" element={<Gate><CreateListing /></Gate>} />
      <Route path="/marketplace/:id" element={<Gate><ListingDetail /></Gate>} />
      <Route path="/services" element={<Gate><Services /></Gate>} />
      <Route path="/services/new" element={<Gate><CreateService /></Gate>} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Gate><Dashboard /></Gate>} />
      <Route path="/Profile" element={<Gate allowUnapproved><Profile /></Gate>} />
      <Route path="/admin" element={<Gate><Admin /></Gate>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}