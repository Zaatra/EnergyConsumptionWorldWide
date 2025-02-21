import PropTypes from 'prop-types';

/**
 * Header component with navigation and view controls.
 * Extra buttons (Country/Zone toggles, info-icon, and API Access) have been removed.
 */
function Header({ onProductionClick, onConsumptionClick, viewMode }) {
  return (
    <header className="electricity-maps-header">
      <div className="header-left">
        <div className="logo">ELECTRICITY MAPS</div>
        <nav className="header-nav">
          <ul>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#methodology">Methodology</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#community">Community</a></li>
            <li><a href="#blog">Blog</a></li>
          </ul>
        </nav>
      </div>
      <div className="header-right">
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
        </div>
      </div>
    </header>
  );
}

Header.propTypes = {
  onProductionClick: PropTypes.func.isRequired,
  onConsumptionClick: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['production', 'consumption']),
};

Header.defaultProps = {
  viewMode: 'production'
};

export default Header;
