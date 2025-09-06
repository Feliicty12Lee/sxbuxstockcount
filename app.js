(async () => {
  try {
    const preview = document.getElementById("preview");
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    preview.setAttribute("playsinline", "true");
    preview.setAttribute("autoplay", "true");
    preview.muted = true;
    preview.srcObject = stream;
    await preview.play();
    alert("✅ Camera started!");
  } catch (err) {
    alert("❌ Camera failed: " + err.name + " - " + err.message);
  }
})();
