import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Gate from "./components/Gate";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";

// Stage 17a: each page is its own file, downloaded the first time it's opened.
const Landing = lazy(() => import("./pages/Landing"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const ListingDetail = lazy(() => import("./pages/ListingDetail"));
const Services = lazy(() => import("./pages/Services"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const CreateService = lazy(() => import("./pages/CreateService"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));
const Admin = lazy(() => import("./pages/Admin"));
const CreateListing = lazy(() => import("./pages/CreateListing"));
const Saved = lazy(() => import("./pages/Saved"));
const MyListings = lazy(() => import("./pages/MyListings"));
const Chat = lazy(() => import("./pages/Chat"));
const Messages = lazy(() => import("./pages/Messages"));
const NotFound = lazy(() => import("./pages/NotFound"));


export default function App() {
  return (
    <>
    <OfflineBanner />
    <ErrorBoundary fullScreen homeTo="/">
    <Suspense fallback={<PageLoader fullScreen />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/Home" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Every signed-in page: ONE Gate (account check) + the sidebar shell,
          kept mounted while moving between these pages. Pending users may
          only open /Profile (shown without the shell). */}
      <Route element={<Gate withShell allowUnapprovedPaths={["/profile"]}><ErrorBoundary><Suspense fallback={<PageLoader />}><Outlet /></Suspense></ErrorBoundary></Gate>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/new" element={<CreateListing />} />
        <Route path="/marketplace/:id" element={<ListingDetail />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/new" element={<CreateService />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/my-listings" element={<MyListings />} />
        <Route path="/messages" element={<Messages />}>
          <Route path=":convId" element={<Chat />} />
        </Route>
        <Route path="/Profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </ErrorBoundary>
    </>
  );
}
