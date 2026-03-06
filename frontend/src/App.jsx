import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UserSettingsProvider } from './context/UserSettingsContext'
import { SocialProvider } from './context/SocialContext'
import { RulesProvider } from './context/RulesContext'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import ProfileDetail from './pages/ProfileDetail'
import Admin from './pages/Admin'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import NotFound from './pages/NotFound'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Imprint from './pages/Imprint'
import Rules from './pages/Rules'
import ThoughtPage from './pages/ThoughtPage'
import LoadingSpinner from './components/LoadingSpinner'
import PigGameList from './pages/PigGameList'
import PigGame from './pages/PigGame'
import RuleDetail from './pages/RuleDetail'
import AdminRules from './pages/AdminRules'
import AcademyLanding from './pages/AcademyLanding'
import Applications from './pages/Applications'
import ApplicationSubmission from './pages/ApplicationSubmission'
import AdminApplications from './pages/AdminApplications'
import { NotificationProvider } from './context/NotificationContext'
import AcademyCategory from './pages/AcademyCategory'
import AcademyArticle from './pages/AcademyArticle'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner className="min-h-screen" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner className="min-h-screen" />
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <UserSettingsProvider>
        <SocialProvider>
          <RulesProvider>
            <NotificationProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/legal/privacy-policy" element={<Layout><PrivacyPolicy /></Layout>} />
                <Route path="/legal/imprint" element={<Layout><Imprint /></Layout>} />
                <Route path="/legal/rules" element={<Layout><Rules /></Layout>} />
                <Route path="/legal/rules/:id" element={<Layout><RuleDetail /></Layout>} />
                <Route path="/" element={<Layout><Landing /></Layout>} />
                <Route path="/profiles/:slug" element={<Layout><ProfileDetail /></Layout>} />
                <Route path="/pig" element={<Layout><PigGameList /></Layout>} />
                <Route path="/pig/:slug" element={<PigGame />} />
                <Route path="/thoughts/:slug" element={<Layout><ThoughtPage /></Layout>} />
                <Route path="/academy" element={<Layout><AcademyLanding /></Layout>} />
                <Route path="/academy/:category" element={<Layout><AcademyCategory /></Layout>} />
                <Route path="/academy/:category/:article" element={<Layout><AcademyArticle /></Layout>} />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <Layout>
                        <Admin />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/rules"
                  element={
                    <AdminRoute>
                      <Layout>
                        <AdminRules />
                      </Layout>
                    </AdminRoute>
                  }
                />
                <Route path="/applications" element={<Layout><ProtectedRoute><Applications /></ProtectedRoute></Layout>} />
                <Route path="/applications/:id" element={<Layout><ProtectedRoute><ApplicationSubmission /></ProtectedRoute></Layout>} />
                <Route path="/admin/applications" element={<AdminRoute><Layout><AdminApplications /></Layout></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            </NotificationProvider>
          </RulesProvider>
        </SocialProvider>
      </UserSettingsProvider>
    </AuthProvider>
  )
}
