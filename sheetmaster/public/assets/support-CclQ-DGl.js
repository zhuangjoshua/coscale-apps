import{a as r,m as l,b as c,j as e,L as n,C as d,c as u,d as h,e as m,f as p,u as f}from"./index-Cj4elldp.js";import{B as g}from"./back-button-DqZwzFjj.js";import{B as y}from"./badge-9C47Uir-.js";function v(o){const a=r();return{access:o,productName:c(),brandMarkSrc:l(),homeHref:o.authenticated?"/app":"/",publicItems:[{href:"/",label:"Home"},{href:"/pricing",label:"Pricing"},{href:"/faq",label:"FAQ"},{href:"/privacy",label:"Privacy"},{href:"/terms",label:"Terms"}],accountItems:[{href:"/app",label:"App"},{href:"/app/profile",label:"Account"}],authBusy:a.busy,authDisabled:!a.available||!a.configured||a.busy,logIn:a.signInWithGoogle,signUp:a.signUpWithGoogle,signOut:a.logout}}function b({access:o}){const a=v(o);return e.jsx("header",{"data-takyon-public-header":"true",children:e.jsxs("div",{"data-takyon-header-inner":"true",children:[e.jsxs(n,{to:a.homeHref,"data-takyon-brand":"true",children:[a.brandMarkSrc?e.jsx("img",{src:a.brandMarkSrc,alt:`${a.productName} logo`,width:40,height:40,"data-takyon-brand-mark":"true"}):null,e.jsx("span",{"data-takyon-brand-name":"true",children:a.productName})]}),o.loading?e.jsx("div",{"data-takyon-navigation-loading":"true",role:"status","aria-live":"polite",children:"Loading navigation"}):o.authenticated?e.jsxs("nav",{"aria-label":"Account navigation","data-takyon-account-navigation":"true",children:[a.accountItems.map(t=>e.jsx(n,{to:t.href,"data-takyon-navigation-link":"true",children:t.label},t.href)),e.jsx("button",{type:"button",onClick:()=>void a.signOut(),disabled:a.authBusy,"data-takyon-auth-action":"signout",children:"Sign out"})]}):e.jsxs("div",{"data-takyon-signed-out-navigation":"true",children:[e.jsx("nav",{"aria-label":"Public navigation","data-takyon-public-navigation":"true",children:a.publicItems.map(t=>e.jsx(n,{to:t.href,"data-takyon-navigation-link":"true",children:t.label},t.href))}),e.jsx("button",{type:"button",onClick:()=>void a.logIn(),disabled:a.authDisabled,"data-takyon-auth-action":"login",children:"Log in"}),e.jsx("button",{type:"button",onClick:()=>void a.signUp(),disabled:a.authDisabled,"data-takyon-auth-action":"signup",children:"Sign up"})]})]})})}function S({eyebrow:o,title:a,description:t,children:i}){const s=f();return e.jsxs("main",{className:"min-h-screen bg-background",children:[e.jsx(b,{access:s}),e.jsxs("div",{className:"mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 sm:py-14",children:[e.jsx(g,{}),e.jsxs("header",{className:"flex flex-col gap-4 border-b border-border pb-8",children:[e.jsx(y,{variant:"outline",className:"w-fit",children:o}),e.jsx("h1",{className:"font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl",children:a}),e.jsx("p",{className:"max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg",children:t})]}),i]})]})}function C(){return e.jsx(S,{eyebrow:"Articles",title:"Guides and updates",description:"Product guides, release notes, and support articles.",children:e.jsxs(d,{children:[e.jsxs(u,{children:[e.jsx(h,{children:"No articles published yet"}),e.jsx(m,{children:"Guides will appear here as the product grows."})]}),e.jsx(p,{children:e.jsx(n,{to:"/faq",className:"inline-flex rounded border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted",children:"Browse FAQ"})})]})})}const w=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="pricing">
<h1 class="page-title">Simple pricing for any form, any volume</h1>
<div class="card-surface plan-card">
  <div class="card-content">
    <h2>SheetSmile Pro</h2>
    <p class="plan-price"><span data-plan-token="price">$00</span><span class="plan-interval">/mo</span></p>
    <p class="plan-desc">Everything you need to collect form data without a backend — one plan, no surprises.</p>
    <ul class="plan-features">
      <li>Unlimited form endpoints for all your projects</li>
      <li>Google Sheets and Notion destinations</li>
      <li>File uploads on every form</li>
      <li>Built-in spam protection</li>
      <li>Custom email notifications</li>
      <li>Autoresponders for submitters</li>
      <li>Custom redirect URLs</li>
      <li>Webhook support for advanced workflows</li>
      <li>Submission history and management dashboard</li>
      <li>Works with any frontend — HTML, React, Webflow, and more</li>
    </ul>
    <a class="pill cta-primary" href="/app">Get Started Free</a>
  </div>
</div>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`,k=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="faq">
<h1 class="page-title">Frequently asked questions</h1>
<div class="faq-list">
  <details class="faq-item" open>
    <summary class="faq-q">What is SheetSmile?</summary>
    <div class="faq-a"><p>SheetSmile is a lightweight form backend that sends website form submissions directly into Google Sheets or Notion — no servers, no code, no database setup. You connect a spreadsheet, get a unique endpoint URL, and every form submission lands as a new row or record automatically.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">How do I connect my Google Sheet?</summary>
    <div class="faq-a"><p>Sign in with your Google account, select the spreadsheet and worksheet you want to use, and SheetSmile automatically maps your form fields to columns. You'll get a unique endpoint URL immediately — paste it into your form's action attribute and you're done.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">Does SheetSmile work with Notion?</summary>
    <div class="faq-a"><p>Yes. Connect a Notion database the same way — SheetSmile maps your form fields to Notion database properties automatically. Every submission creates a new structured entry in your workspace, fully searchable and organized alongside the rest of your team's content.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">What kind of forms can I use with SheetSmile?</summary>
    <div class="faq-a"><p>Any HTML form, React application, or website builder form that can POST to a URL. SheetSmile works with plain HTML forms, static site generators, WordPress, Webflow, Framer, Carrd, and any custom frontend. Just point your form's action attribute at your SheetSmile endpoint.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">How does spam protection work?</summary>
    <div class="faq-a"><p>SheetSmile automatically filters spam submissions in the background before they reach your spreadsheet. No CAPTCHAs or configuration required — the protection is built into every endpoint and blocks known spam patterns without affecting real submissions.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">Can I upload files through my form?</summary>
    <div class="faq-a"><p>Yes. SheetSmile supports file uploads on every form. When a user attaches a file to your form, it's stored securely and linked from the corresponding row in your Google Sheet or Notion database.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">How do I sign in and manage my account?</summary>
    <div class="faq-a"><p>Sign in uses your Google account — no separate password to remember. Once signed in, you can manage your form endpoints, view submission history, update notification settings, and handle your subscription from your account profile.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">How do subscriptions and billing work?</summary>
    <div class="faq-a"><p>SheetSmile offers one straightforward Pro plan billed monthly. You can upgrade, manage your payment method, and view invoices from your account profile at any time. Cancel anytime — your endpoints keep working through the end of your billing period.</p></div>
  </details>
  <details class="faq-item">
    <summary class="faq-q">Will my existing forms break if I switch to SheetSmile?</summary>
    <div class="faq-a"><p>No. Just change your form's action URL to your SheetSmile endpoint and keep the same field names. SheetSmile maps your existing form structure automatically — no redesign, no migration, no downtime.</p></div>
  </details>
</div>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`,T=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="product">
<h1 class="page-title">Everything you need to collect form data — without a backend</h1>
<div class="product-story">
  <section class="product-block">
    <h2>Form endpoints that just work</h2>
    <p>SheetSmile turns any Google Sheet or Notion database into a live form backend. Connect your destination once, and we generate a unique endpoint URL for each form. Paste that URL into any HTML form's action attribute, React app, or website builder — submissions flow directly into your spreadsheet with zero server code.</p>
    <ul>
      <li>One unique endpoint per form — create as many as you need for different projects</li>
      <li>Works with plain HTML, React, Vue, Svelte, static sites, WordPress, Webflow, Framer, and Carrd</li>
      <li>Custom form fields map automatically — name your inputs and SheetSmile creates matching columns</li>
    </ul>
  </section>

  <section class="product-block">
    <h2>Your data lands in Google Sheets or Notion</h2>
    <p>Choose the tool your team already uses. Google Sheets is great for reviewing, sorting, and sharing form data like a spreadsheet. Notion turns submissions into structured, searchable database entries that live alongside your team's docs and projects.</p>
    <img src="/proto-assets/section-offerings.jpg" alt="Google Sheets integration showing form submission data">
    <ul>
      <li>Google Sheets — each field becomes a column, each submission a new row, instantly</li>
      <li>Notion Databases — every property maps automatically, submissions become organized entries</li>
      <li>Switch destinations anytime — your endpoints and field mappings stay intact</li>
    </ul>
  </section>

  <section class="product-block">
    <h2>Built-in spam protection and validation</h2>
    <p>No CAPTCHAs, no configuration, no third-party services. SheetSmile filters spam submissions in the background using built-in detection that blocks known patterns without touching real submissions. Your spreadsheet stays clean from the start.</p>
    <ul>
      <li>Automatic spam filtering on every endpoint — nothing to set up</li>
      <li>Field validation ensures required fields and formats are respected</li>
      <li>No CAPTCHA needed — legitimate users never see a puzzle or checkbox</li>
    </ul>
  </section>

  <section class="product-block">
    <h2>File uploads on every form</h2>
    <p>Need to collect resumes, screenshots, design files, or documents? SheetSmile supports file uploads on every form by default. Attached files are stored securely and linked from the corresponding row in your spreadsheet or database — no extra configuration, no storage limits to manage.</p>
    <ul>
      <li>File uploads available on every endpoint — no add-ons or upgrades required</li>
      <li>Secure storage with links directly in your spreadsheet rows</li>
      <li>Works alongside text fields, checkboxes, and all other form inputs</li>
    </ul>
  </section>

  <section class="product-block">
    <h2>Email notifications and autoresponders</h2>
    <p>Stay on top of every submission and keep your users informed. SheetSmile sends custom email notifications to your team when new submissions arrive, and can automatically reply to submitters with a confirmation or thank-you message.</p>
    <ul>
      <li>Custom email notifications — get alerted the moment a submission arrives</li>
      <li>Autoresponders — send confirmation emails to anyone who fills out your form</li>
      <li>Customize subject lines, sender names, and message content per form</li>
    </ul>
  </section>

  <section class="product-block">
    <h2>Webhooks, redirects, and advanced controls</h2>
    <p>SheetSmile integrates into your existing workflows. Fire a webhook to trigger automations in Zapier or Make. Redirect users to a custom thank-you page after submission. View full submission history from your dashboard and manage every form from one place.</p>
    <ul>
      <li>Webhook support — POST submission data to any URL for custom integrations</li>
      <li>Custom redirect URLs — send users to a thank-you page or next step after submitting</li>
      <li>Submission history dashboard — browse, search, and review every submission across all your forms</li>
      <li>Form management — create, rename, and organize endpoints from a central dashboard</li>
    </ul>
  </section>

</div>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`,x=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="privacy">
<h1 class="page-title">Privacy</h1>
<section>
  <h2>What we store</h2>
  <p>sheetsmile stores the account, product records, and usage receipts needed to
  provide the service: account identity, subscription state, profile details, and the
  content you create inside the product.</p>
</section>
<section>
  <h2>How we use it</h2>
  <p>We use this data to sign you in, manage access, process billing events, and deliver
  the features you request. We do not sell your data.</p>
</section>
<section>
  <h2>Sign-in and billing</h2>
  <p>Sign-in uses your Google account. Subscription billing and payment events are handled
  by secure payment processors; sheetsmile never stores your card details.</p>
</section>
<section>
  <h2>Contact</h2>
  <p>Questions about this policy are answered through the support channel inside the
  product.</p>
</section>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`,A=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="terms">
<h1 class="page-title">Terms</h1>
<section>
  <h2>The service</h2>
  <p>sheetsmile provides the features described on this site to subscribed accounts.
  Access requires an active subscription in good standing.</p>
</section>
<section>
  <h2>Subscriptions</h2>
  <p>Subscriptions renew automatically until cancelled. You can cancel from your account
  profile at any time; access and renewal behavior after cancellation follow the terms
  shown at checkout and in your account.</p>
</section>
<section>
  <h2>Acceptable use</h2>
  <p>You agree not to misuse the service, attempt to disrupt it, or use it to violate the
  law or the rights of others.</p>
</section>
<section>
  <h2>Changes</h2>
  <p>We may update the service and these terms; material changes are communicated through
  the product.</p>
</section>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`,q=`
<header class="site-nav">
  <div class="brand">SheetSmile</div>
    <nav><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="#" class="pill nav-login">Sign in</a><a class="pill nav-cta" href="/app">Get Started Free</a></nav>
</header>
<main data-takyon-page="blog">
<h1 class="page-title">Blog</h1>
<div class="blog-empty">
  <p class="blog-empty-lead">Articles from the sheetsmile team are on the way.</p>
  <p>We're writing about the problems this product solves and how to get the most out of
  it. Check back soon — or head back to the <a href="/">homepage</a> to get
  started today.</p>
</div>
</main>
<footer class="site-footer">
  <!-- TAKYON:FOOTER-CTA:START -->
  <section data-composition="full-width" data-intent="close" data-layout="close" data-footer-cta="true">
  <div class="section-frame" data-focal="primary">
    <h2 class="section-title">Ready to turn your forms into spreadsheets?</h2>
    <p>Connect a Google Sheet or Notion database, get your endpoint, and start collecting form data in minutes — with zero backend code.</p>
    <a href="#">Get Started Free</a>
  </div>
</section>
<!-- TAKYON:FOOTER-CTA:END -->
  <div class="footer-inner">
    <div class="footer-brand">SheetSmile</div>
    <nav aria-label="Footer"><a href="/">Home</a><a href="/product">Product</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/blog">Blog</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav>
  </div>
</footer>
`;function O(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:w}})}function j(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:k}})}function R(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:T}})}function H(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:x}})}function G(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:A}})}function L(){return e.jsx("div",{className:"proto-page",dangerouslySetInnerHTML:{__html:q}})}export{C as ArticlesScreen,L as BlogScreen,j as FaqScreen,O as PricingScreen,H as PrivacyScreen,R as ProductScreen,G as TermsScreen};
