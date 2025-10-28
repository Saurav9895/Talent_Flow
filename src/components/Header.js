import { Link } from "react-router-dom";
import { useState } from "react";
import "./Header.css";

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="header-content">
        <Link to="/" className="logo">
          TalentFlow
        </Link>
        <button
          className={`menu-toggle ${isMenuOpen ? "open" : ""}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger"></span>
        </button>
        <nav className={`main-nav ${isMenuOpen ? "open" : ""}`}>
          <Link to="/jobs" onClick={() => setIsMenuOpen(false)}>
            Jobs
          </Link>
          <Link to="/candidates" onClick={() => setIsMenuOpen(false)}>
            Candidates
          </Link>
          <Link to="/assessments" onClick={() => setIsMenuOpen(false)}>
            Assessments
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
