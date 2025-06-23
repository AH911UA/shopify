if (typeof fbq !== 'undefined' && typeof window.FB_PURCHASE_VALUE !== 'undefined') {
  fbq('track', 'Purchase', {
    value: window.FB_PURCHASE_VALUE,
    currency: 'EUR'
  });
} 