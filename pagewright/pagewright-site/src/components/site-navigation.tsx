import { Link } from "react-router-dom";
import "../site-header.css";
import {
  usePublicSiteNavigation,
  type PublicSiteHeaderAccess,
} from "../lib/public-site-navigation";

export function PublicSiteHeader({ access }: { access: PublicSiteHeaderAccess }) {
  const navigation = usePublicSiteNavigation(access);

  return (
    <header data-takyon-public-header="true">
      <div data-takyon-header-inner="true">
        <Link to={navigation.homeHref} data-takyon-brand="true">
          {navigation.brandMarkSrc ? (
          <img
            src={navigation.brandMarkSrc}
            alt={`${navigation.productName} logo`}
            width={40}
            height={40}
            data-takyon-brand-mark="true"
          />
          ) : null}
          <span data-takyon-brand-name="true">{navigation.productName}</span>
        </Link>

        {access.loading ? (
          <div data-takyon-navigation-loading="true" role="status" aria-live="polite">
            Loading navigation
          </div>
        ) : access.authenticated ? (
          <nav aria-label="Account navigation" data-takyon-account-navigation="true">
            {navigation.accountItems.map((item) => (
              <Link key={item.href} to={item.href} data-takyon-navigation-link="true">
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => void navigation.signOut()}
              disabled={navigation.authBusy}
              data-takyon-auth-action="signout"
            >
              Sign out
            </button>
          </nav>
        ) : (
          <div data-takyon-signed-out-navigation="true">
            <nav aria-label="Public navigation" data-takyon-public-navigation="true">
              {navigation.publicItems.map((item) => (
                <Link key={item.href} to={item.href} data-takyon-navigation-link="true">
                  {item.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void navigation.logIn()}
              disabled={navigation.authDisabled}
              data-takyon-auth-action="login"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => void navigation.signUp()}
              disabled={navigation.authDisabled}
              data-takyon-auth-action="signup"
            >
              Sign up
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
