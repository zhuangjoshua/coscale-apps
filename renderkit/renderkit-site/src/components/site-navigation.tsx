import { Link } from "react-router-dom";
import "../site-header.css";
import {
  usePublicSiteNavigation,
  type PublicSiteHeaderAccess,
} from "../lib/public-site-navigation";

export function PublicSiteHeader({ access }: { access: PublicSiteHeaderAccess }) {
  const navigation = usePublicSiteNavigation(access);

  return (
    <header data-rk-public-header="true">
      <div data-rk-header-inner="true">
        <Link to="/" data-rk-brand="true">
          {navigation.brandMarkSrc ? (
          <img
            src={navigation.brandMarkSrc}
            alt={`${navigation.productName} logo`}
            width={40}
            height={40}
            data-rk-brand-mark="true"
          />
          ) : null}
          <span data-rk-brand-name="true">{navigation.productName}</span>
        </Link>

        {access.loading ? (
          <div data-rk-navigation-loading="true" role="status" aria-live="polite">
            Loading navigation
          </div>
        ) : access.authenticated ? (
          <nav aria-label="Account navigation" data-rk-account-navigation="true">
            {/* /app is served by the express server: plain anchors, full page load. */}
            {navigation.accountItems.map((item) => (
              <a key={item.href} href={item.href} data-rk-navigation-link="true">
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => void navigation.signOut()}
              disabled={navigation.authBusy}
              data-rk-auth-action="signout"
            >
              Sign out
            </button>
          </nav>
        ) : (
          <div data-rk-signed-out-navigation="true">
            <nav aria-label="Public navigation" data-rk-public-navigation="true">
              {navigation.publicItems.map((item) => (
                <Link key={item.href} to={item.href} data-rk-navigation-link="true">
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void navigation.logIn()}
              disabled={navigation.authDisabled}
              data-rk-auth-action="login"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => void navigation.signUp()}
              disabled={navigation.authDisabled}
              data-rk-auth-action="signup"
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
