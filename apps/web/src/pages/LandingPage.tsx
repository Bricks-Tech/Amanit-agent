import { createElement } from "react";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="landing-root">
      <div className="bg-wash" />
      <div className="grain" />

      <header className="topbar">
        <p className="hours">Breakfast 8:00–12:30 · Lunch &amp; dinner from 13:00</p>
        <div className="topbar-right">
          <p className="location">Amanit</p>
          <Link className="staff-link" to="/login">
            Admin
          </Link>
        </div>
      </header>

      <main className="stage">
        <section className="hero">
          <p className="eyebrow">Table-side, over the phone</p>
          <h1 className="script">Amanit</h1>
          <h2 className="headline">Voice concierge</h2>
          <div className="rule">
            <span />
            <i />
            <span />
          </div>
          <p className="lede">
            Ask about breakfast, lunch, or dinner — prices, dietary notes, and what to
            order. Tap the widget and speak.
          </p>
          <ul className="pills">
            <li>Vegetarian · Vegan · Gluten free</li>
            <li>10% VAT included</li>
            <li>Allergies? Tell us first</li>
          </ul>
        </section>

        <section className="widget-card" aria-label="Call the Amanit voice agent">
          <div className="card-glow" />
          <p className="card-kicker">Live agent</p>
          <h3>Talk to Amanit</h3>
          <p className="card-copy">
            The assistant uses our current menus. Breakfast until 12:30, then lunch &amp;
            dinner from 1pm.
          </p>
          <div className="widget-slot">
            <div className="prompt-panel">
              <div className="mic-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect
                    x="9"
                    y="3"
                    width="6"
                    height="11"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M6.5 11.5a5.5 5.5 0 0 0 11 0"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 17v3.5M8.5 20.5h7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="prompt-title">Try asking</p>
              <ul className="prompts">
                <li>“What’s good for breakfast?”</li>
                <li>“Do you have vegan or gluten-free?”</li>
                <li>“How much is the Wagyu Smash Burger?”</li>
              </ul>
            </div>
          </div>
          <p className="mic-hint">Use the round button in the corner to start speaking.</p>
          {createElement("elevenlabs-convai", {
            "agent-id": "agent_2401m2tcwarpf8598fxz7zyk34zc",
          })}
        </section>
      </main>

      <footer>
        <p>
          Please inform us of any allergies · Fishery products follow Anisakis prevention
          standards
        </p>
      </footer>
    </div>
  );
}
