import PropTypes from 'prop-types';

/**
 * Header component with navigation and view controls
 */
function Header({ 
  onProductionClick, 
  onConsumptionClick, 
  onCountryClick, 
  onZoneClick, 
  viewMode, 
  zoneViewEnabled 
}) {
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
        <div className="toggle-group">
          <button 
            className={`toggle-button ${!zoneViewEnabled ? 'active' : ''}`}
            onClick={onCountryClick}
          >
            Country
          </button>
          <button 
            className={`toggle-button ${zoneViewEnabled ? 'active' : ''}`}
            onClick={onZoneClick}
          >
            Zone
          </button>
          <span className="info-icon" title="Switch between country and zone view">ⓘ</span>
        </div>
        <a href="#api" className="access-api-button">API Access</a>
      </div>
    </header>
  );
}

// Add prop types validation
Header.propTypes = {
  onProductionClick: PropTypes.func.isRequired,
  onConsumptionClick: PropTypes.func.isRequired,
  onCountryClick: PropTypes.func.isRequired,
  onZoneClick: PropTypes.func.isRequired,
  viewMode: PropTypes.oneOf(['production', 'consumption']),
  zoneViewEnabled: PropTypes.bool
};

// Add default props
Header.defaultProps = {
  viewMode: 'production',
  zoneViewEnabled: false
};

export default Header;