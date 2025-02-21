import PropTypes from 'prop-types';
import { Link } from 'react-router-dom'; // Import Link from react-router-dom

/**
 * Header component with a logo, a single navigation link ("Interesting Charts"),
 * view controls, and a dark/light mode toggle.
 */
function Header({ onProductionClick, onConsumptionClick, viewMode, onThemeToggle, isLightMode }) {
  return (
    <header className="electricity-maps-header">
      <div className="header-content">
        <div className="logo">ELECTRICITY MAPS</div>
        <nav className="header-nav">
          <ul>
            <li>
              <Link to="/">Interesting Charts</Link> {/* Link to home page */}
            </li>
            <li>
              <Link to="/about">About</Link> {/* Link to About page */}
            </li>
          </ul>
        </nav>
        <div className="toggle-group">
          <button
            className={`toggle-button ${viewMode === 'production' ? 'active' : ''}`}
            onClick={onProductionClick}
          >
            Production
          </button>
          <button
            className={`toggle-button ${viewMode === 'consumption' ? 'active' : ''}`}
            onClick={onConsumptionClick}
          >
            Consumption
          </button>
          {/* Theme toggle button */}
          <button
            className="toggle-button"
            onClick={onThemeToggle}
            title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {isLightMode ? <i className="fas fa-moon"></i> : <i className="fas fa-sun"></i>}
          </button>
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  onProductionClick: PropTypes.func.isRequired,
  onConsumptionClick: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['production', 'consumption']),
  onThemeToggle: PropTypes.func.isRequired,
  isLightMode: PropTypes.bool.isRequired,
};

Header.defaultProps = {
  viewMode: 'production',
};

export default Header;
