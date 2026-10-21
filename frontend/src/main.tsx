import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./styles.css";
import { AuthProvider } from "./auth";
import {
  Layout,
  Home,
  Explore,
  EventDetail,
  AuthPage,
  MyRegistrations,
  Manage,
  EventForm,
  RequireAuth,
  NotFound,
} from "./App";
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/explore", element: <Explore /> },
      { path: "/events/:id", element: <EventDetail /> },
      { path: "/login", element: <AuthPage kind="login" /> },
      { path: "/register", element: <AuthPage kind="register" /> },
      {
        path: "/registrations",
        element: (
          <RequireAuth>
            <MyRegistrations />
          </RequireAuth>
        ),
      },
      {
        path: "/manage",
        element: (
          <RequireAuth organizer>
            <Manage />
          </RequireAuth>
        ),
      },
      {
        path: "/manage/new",
        element: (
          <RequireAuth organizer>
            <EventForm />
          </RequireAuth>
        ),
      },
      {
        path: "/manage/:id/edit",
        element: (
          <RequireAuth organizer>
            <EventForm />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <RouterProvider router={router} />
  </AuthProvider>,
);
