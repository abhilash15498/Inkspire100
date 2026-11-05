import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { AuthorLayout, Layout, Loading, PageHeader } from './ui.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import About from './pages/About.jsx';
import Privacy from './pages/Privacy.jsx';
import Terms from './pages/Terms.jsx';
import Book from './pages/Book.jsx';
import Chapters from './pages/Chapters.jsx';
import Reader from './pages/Reader.jsx';
import MyFeedback from './pages/MyFeedback.jsx';
import Dashboard from './author/Dashboard.jsx';
import ChapterEditor from './author/ChapterEditor.jsx';
import NewChapter from './author/NewChapter.jsx';
import FeedbackInbox from './author/FeedbackInbox.jsx';
import Reviewers from './author/Reviewers.jsx';
import BookEditor from './author/BookEditor.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function RequireAuthor({ children }) {
  const { isAuthor } = useAuth();
  if (!isAuthor) {
    return (
      <>
        <PageHeader title="Not allowed" />
        <p>Only the author can open this page.</p>
      </>
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        {/* Public Storefront & Legal Routes */}
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="book" element={<Book />} />

        {/* Protected Reader & Feedback Routes */}
        <Route
          path="chapters"
          element={
            <RequireAuth>
              <Chapters />
            </RequireAuth>
          }
        />
        <Route
          path="chapters/:id"
          element={
            <RequireAuth>
              <Reader />
            </RequireAuth>
          }
        />
        <Route
          path="feedback"
          element={
            <RequireAuth>
              <MyFeedback />
            </RequireAuth>
          }
        />

        {/* Protected Author Dashboard */}
        <Route
          path="author"
          element={
            <RequireAuth>
              <RequireAuthor>
                <AuthorLayout />
              </RequireAuthor>
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chapters/new" element={<NewChapter />} />
          <Route path="chapters/:id" element={<ChapterEditor />} />
          <Route path="feedback" element={<FeedbackInbox />} />
          <Route path="reviewers" element={<Reviewers />} />
          <Route path="book" element={<BookEditor />} />
        </Route>

        <Route path="*" element={<PageHeader title="Page not found" />} />
      </Route>
    </Routes>
  );
}
