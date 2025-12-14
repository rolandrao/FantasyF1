import { Link } from 'react-router-dom';

const Navbar = ({ session }) => {
  return (
    <nav style={styles.nav}>
      <div style={styles.logo}>🏎️ F1 Fantasy</div>
      
      {session && (
        <ul style={styles.links}>
          <li><Link to="/" style={styles.link}>Home</Link></li>
          <li><Link to="/team" style={styles.link}>My Team</Link></li>
          <li><Link to="/league" style={styles.link}>League</Link></li>
          <li><Link to="/f1-stats" style={styles.link}>Formula 1</Link></li>
          <li><Link to="/draft" style={styles.link}>Draft Room</Link></li>
        </ul>
      )}
      
      {!session ? (
        <Link to="/login" style={styles.button}>Log In</Link>
      ) : (
        <button style={styles.button} onClick={() => alert("Add logout logic")}>Log Out</button>
      )}
    </nav>
  );
};

// Simple CSS for layout (we can upgrade to Tailwind later)
const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#1e1e1e', // Dark mode style
    color: 'white',
  },
  logo: { fontSize: '1.5rem', fontWeight: 'bold' },
  links: {
    display: 'flex',
    gap: '20px',
    listStyle: 'none',
  },
  link: { color: '#ccc', textDecoration: 'none', fontSize: '1rem' },
  button: {
    padding: '8px 16px',
    backgroundColor: '#e10600', // F1 Red
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    textDecoration: 'none',
    cursor: 'pointer'
  }
};

export default Navbar;