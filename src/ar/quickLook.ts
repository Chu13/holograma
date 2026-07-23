export type QuickLookOptions = {
  /** URL of the .usdz file — required, must end in .usdz. */
  usdzUrl: string;
  /** The page to return to when the user dismisses Quick Look. */
  canonicalWebPageURL?: string;
  /** Apple defaults this to true; pass false to disable pinch-to-scale. */
  allowsContentScaling?: boolean;
};

export type QuickLookLink = {
  rel: "ar";
  href: string;
};

/**
 * Build the `<a rel="ar" href="...">` link iOS Quick Look expects.
 * Options are encoded as a URL fragment per Apple's AR Quick Look spec —
 * https://developer.apple.com/documentation/arkit/adding_an_apple_pay_button_or_a_custom_action_in_ar_quick_look
 */
export function buildQuickLookLink({
  usdzUrl,
  canonicalWebPageURL,
  allowsContentScaling,
}: QuickLookOptions): QuickLookLink {
  if (!usdzUrl.toLowerCase().endsWith(".usdz")) {
    throw new Error("buildQuickLookLink: usdzUrl must point to a .usdz file.");
  }

  const fragmentParts: string[] = [];
  if (canonicalWebPageURL) {
    fragmentParts.push(`canonicalWebPageURL=${encodeURIComponent(canonicalWebPageURL)}`);
  }
  if (allowsContentScaling === false) {
    fragmentParts.push("allowsContentScaling=0");
  }

  const href =
    fragmentParts.length > 0 ? `${usdzUrl}#${fragmentParts.join("&")}` : usdzUrl;

  return { rel: "ar", href };
}
