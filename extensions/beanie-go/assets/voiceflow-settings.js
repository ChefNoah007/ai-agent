// This file is loaded by the voiceflow_settings.liquid app block
// It makes the Voiceflow settings available to the chat components

(function() {
  // Check if the settings were injected by the app block
  if (window.VOICEFLOW_SETTINGS) {
    console.log('Voiceflow settings loaded from app block:', {
      vf_key: window.VOICEFLOW_SETTINGS.vf_key ? "Present (masked)" : "Missing",
      vf_project_id: window.VOICEFLOW_SETTINGS.vf_project_id || "Missing",
      vf_version_id: window.VOICEFLOW_SETTINGS.vf_version_id || "Missing"
    });
  } else {
    console.warn('Voiceflow settings not found in window.VOICEFLOW_SETTINGS');
    
    // Fallback to default settings if not available
    window.VOICEFLOW_SETTINGS = {
      vf_key: "VF.DM.670508f0cd8f2c59f1b534d4.t6mfdXeIfuUSTqUi",
      vf_project_id: "6703af9afcd0ea507e9c5369",
      vf_version_id: "6703af9afcd0ea507e9c536a"
    };
    
    console.log('Using fallback Voiceflow settings');
  }
})();
