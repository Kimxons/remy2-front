// "use client"

// import ErrorPage from "./react-pages/error/ErrorPage.jsx"
// import "./app.scss"
// import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom"
// import Navbar from "./components/navbar/Navbar.jsx"
// import Footer from "./components/footer/Footer.jsx"
// import AdminRoute from "./components/routes/AdminRoute.jsx"

// import AdminDashboard from "./react-pages/admin/AdminDashboard.jsx"
// import About from "./react-pages/about/About.jsx"
// import Jobs from "./react-pages/jobs/Jobs.jsx"
// import Orders from "./react-pages/orders/Orders.jsx"
// import Earnings from "./react-pages/earnings/Earnings.jsx"
// import Dashboard from "./react-pages/dashboard/Dashboard.jsx"
// import Profile from "./react-pages/profile/Profile.jsx"
// import Job from "./react-pages/job/Job.jsx"
// import PostJob from "./react-pages/jobs/PostJob.jsx"
// import Messages from "./react-pages/messages/Messages.jsx"
// import Thread from "./react-pages/message/Thread.jsx"
// import Login from "./react-pages/login/Login.jsx"
// import Register from "./react-pages/register/Register.jsx"
// import Home from "./react-pages/home/Home.jsx"
// import Categories from "./react-pages/categories/Categories.jsx"
// import MessageDetail from "./react-pages/messages/MessageDetail.jsx"
// import SentOffers from "./react-pages/dashboard/sent-offers.jsx"
// import Settings from "./react-pages/settings/Settings.jsx"

// import { useMemo } from "react"

// /**
//  * Layout component that wraps all pages with Navbar and Footer
//  * @returns {JSX.Element} The layout wrapper
//  */
// const Layout = () => {
//   return (
//     <div className="app">
//       <Navbar />
//       <div className="content">
//         <Outlet />
//       </div>
//       <Footer />
//     </div>
//   )
// }

// /**
//  * Main App component that sets up routing for the entire application
//  * Uses React Router for client-side routing within Next.js
//  * @returns {JSX.Element} The router provider with all routes
//  */
// function App() {
//   // Create router once and memoize it to prevent recreation on every render
//   const router = useMemo(
//     () =>
//       createBrowserRouter([
//         {
//           path: "/",
//           element: <Layout />,
//           errorElement: <ErrorPage />,
//           children: [
//             { index: true, element: <Home /> },
//             { path: "about", element: <About /> },
//             { path: "categories", element: <Categories /> },
//             { path: "jobs", element: <Jobs /> },
//             { path: "jobs/:id", element: <Job /> },
//             { path: "post-job", element: <PostJob /> },
//             { path: "threads", element: <Messages /> },
//             { path: "threads/:id", element: <Thread /> },
//             { path: "orders", element: <Orders /> },
//             { path: "earnings", element: <Earnings /> },
//             { path: "dashboard", element: <Dashboard /> },
//             { path: "dashboard/sent-offers", element: <SentOffers /> },
//             { path: "profile", element: <Profile /> },
//             { path: "settings", element: <Settings /> },
//             { path: "messages", element: <Messages /> },
//             { path: "messages/:id", element: <MessageDetail /> },
//             { path: "message/:id", element: <MessageDetail /> },
//             { path: "register", element: <Register /> },
//             { path: "login", element: <Login /> },
//             {
//               path: "admin",
//               element: (
//                 <AdminRoute>
//                   <AdminDashboard />
//                 </AdminRoute>
//               ),
//             },
//           ],
//         },
//       ]),
//     []
//   )

//   return <RouterProvider router={router} />
// }

// export default App
