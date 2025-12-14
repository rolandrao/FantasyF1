import { useState } from 'react'
import { supabase } from '../App'

const Login = () => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault() // Prevents page refresh
    console.log("1. Button Clicked! Email is:", email) // DEBUG LOG
    
    setLoading(true)
    
    console.log("2. Sending request to Supabase...") // DEBUG LOG
    const { error } = await supabase.auth.signInWithOtp({ email })
    
    console.log("3. Supabase responded!") // DEBUG LOG

    if (error) {
      console.error("ERROR:", error.message)
      alert(`Error: ${error.message}`)
    } else {
      console.log("SUCCESS: Email sent.")
      alert('Check your email for the login link!')
    }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center', color: 'white' }}>
      <h2>Sign In</h2>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '10px', width: '100%', marginBottom: '10px' }}
        />
        <button 
          type="submit" 
          disabled={loading} 
          style={{ 
            padding: '10px 20px', 
            cursor: 'pointer', 
            backgroundColor: '#e10600', 
            color: 'white', 
            border: 'none',
            fontSize: '16px' 
          }}
        >
          {loading ? 'Sending...' : 'Send Magic Link'}
        </button>
      </form>
    </div>
  )
}

export default Login