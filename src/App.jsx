import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Landing from "./pages/Landing";
import Marketplace from "./pages/Marketplace";
import ListingDetail from "./pages/ListingDetail";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import CreateService from "./pages/CreateService";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import CreateListing from "./pages/CreateListing";
import Saved from "./pages/Saved";
import MyListings from "./pages/MyListings";
import Chat from "./pages/Chat";
import Gate from "./components/Gate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/Home" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Every signed-in page: ONE Gate (account check) + the sidebar shell,
          kept mounted while moving between these pages. Pending users may
          only open /Profile (shown without the shell). */}
      <Route element={<Gate withShell allowUnapprovedPaths={["/profile"]}><Outlet /></Gate>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/new" element={<CreateListing />} />
        <Route path="/marketplace/:id" element={<ListingDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/new" element={<CreateService />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/my-listings" element={<MyListings />} />
        <Route path="/messages/:convId" element={<Chat />} />
        <Route path="/Profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
