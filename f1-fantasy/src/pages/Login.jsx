import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../App'

const Login = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false) // Toggle between Login/Sign Up

  // Check if already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) navigate('/')
    }
    checkUser()
  }, [navigate])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    let error = null

    if (isSignUp) {
      // 1. SIGN UP
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      error = signUpError
    } else {
      // 2. LOG IN
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      error = signInError
    }

    if (error) {
      alert(error.message)
    } else {
      // If successful, redirect to dashboard
      // Note: If you didn't disable "Confirm Email", this won't work for Sign Up yet
      navigate('/') 
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
      <div className="bg-neutral-800 p-8 rounded-xl border border-neutral-700 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>
        <p className="text-gray-400 text-center mb-6">
            {isSignUp ? 'Join the Fantasy League' : 'Sign in to manage your team'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full bg-neutral-900 border border-neutral-700 text-white p-3 rounded focus:border-red-600 focus:outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full bg-neutral-900 border border-neutral-700 text-white p-3 rounded focus:border-red-600 focus:outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition shadow-lg transform active:scale-95"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
          </button>
        </form>

        <div className="mt-6 text-center">
            <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-gray-400 hover:text-white underline"
            >
                {isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}
            </button>
        </div>
      </div>
    </div>
  )
}

export default Login