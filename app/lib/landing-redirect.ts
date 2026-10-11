/**
 * Someone who already finished setup in this browser does not need the sales
 * page: send them straight to it. Runs before first paint, only on a fresh page load
 * (not when they came from another ai.diy page), and `/?landing` always shows the page.
 * Crawlers and first-time visitors have no stored settings, so they still get it.
 */
export const RETURNING_VISITOR_REDIRECT = `(function(){try{if(location.search.indexOf("landing")>-1)return;var r=document.referrer;if(r){try{if(new URL(r).origin===location.origin)return}catch(e){}}if(localStorage.getItem("prismium-lite:setup-complete"))location.replace("/workspace")}catch(e){}})();`;
