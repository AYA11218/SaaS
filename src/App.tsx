/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import SaaS_Landing_Form from "./components/SaaS_Landing_Form";
import SaaS_Widget_Embed from "./components/SaaS_Widget_Embed";
import SaaS_Dashboard from "./components/SaaS_Dashboard";

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
    };

    // Attach navigation listening listeners
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  // Router matching logic
  if (path.startsWith("/form/")) {
    const campaignSlug = path.substring(6).trim();
    return (
      <SaaS_Landing_Form 
        slug={campaignSlug} 
        onGoHome={() => {
          window.history.pushState({}, "", "/");
          setPath("/");
        }} 
      />
    );
  }

  if (path.startsWith("/embed/")) {
    const widgetId = path.substring(7).trim();
    return <SaaS_Widget_Embed widgetId={widgetId} />;
  }

  // Root SaaS creator administration workstation
  return <SaaS_Dashboard />;
}
