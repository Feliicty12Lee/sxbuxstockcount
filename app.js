async function startCam(){
  try {
    // Step 1: request camera access
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });

    // Step 2: attach to <video>
    preview.setAttribute("playsinline", "true");
    preview.setAttribute("autoplay", "true");
    preview.muted = true;
    preview.srcObject = stream;
    await preview.play();

    // Step 3: now enumerate devices (works only after permission)
    devices = await ZXing.BrowserCodeReader.listVideoInputDevices();
    currentDeviceId = devices.length ? devices[0].deviceId : null;
    camInfo.textContent = devices.length ? `${devices.length} camera(s)` : "No camera found";

    // Step 4: hand over to ZXing for decoding
    scanning = true;
    stopBtn.disabled = false;
    startBtn.disabled = true;
    codeReader.decodeFromVideoDevice(currentDeviceId, preview, (result, err) => {
      if (result) onScan(result.getText());
    });

  } catch (err) {
    console.error(err);
    alert("Camera access failed: " + err.message);
  }
}
