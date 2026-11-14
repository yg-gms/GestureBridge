# GestureBridge

Control Google Slides with your own hand poses and a webcam. Choose poses for
**Next**, **Previous** and **Neutral** (the pose you return to between commands),
then teach GestureBridge to recognise them.

**Web demo (GitHub Pages):** [https://yg-gms.github.io/GestureBridge/](https://yg-gms.github.io/GestureBridge/)

Practise with the built-in presentation in the web demo. To control your own
Google Slides, install the Chrome extension using the steps below.

## Download and install for Google Slides

You need **desktop Google Chrome 116 or newer**, a webcam and an internet
connection for Google Slides. This is a beta version that you install manually.
School or work computers may block this type of installation.

### 1. Download and prepare the extension

There is no ready-to-install download published yet. For now, these commands
prepare the extension from the project files. They use `zip` and `unzip`, which
are included on macOS. On Linux, install those commands first. On Windows, run
the build in a Linux environment such as WSL.

1. Install the **LTS** version of [Node.js](https://nodejs.org/) if you do not
   already have it. It includes the `npm` command used below.
2. [Download the project ZIP](https://github.com/yg-gms/GestureBridge/archive/refs/heads/main.zip)
   and unzip it into a folder you will keep on your computer.
3. Open a terminal in the unzipped project folder. On macOS, open Terminal,
   type `cd `, drag the project folder into the window, then press Enter.
4. Run these commands one at a time:

   ```sh
   npm install
   npm run build:extension
   ```

   This creates a folder named `dist-extension` inside the project folder.

### 2. Add it to Chrome

1. Type `chrome://extensions` into Chrome's address bar and press Enter.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the **dist-extension** folder. Select the
   folder itself, not a ZIP file or the project's `extension` folder.
4. Click Chrome's puzzle-piece **Extensions** button and pin **GestureBridge**.
5. Open your Google Slides presentation in Chrome, then click the GestureBridge
   toolbar icon to open its side panel.

Keep the installed folder on your computer. Chrome loads the extension from it.
See [Chrome's installation guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)
if you need help finding these controls.

## Set up your poses

1. Click **Start camera** in the panel. On first use, a setup tab opens. Click
   **Allow camera access**, accept Chrome's camera prompt, close the setup tab,
   then click **Start camera** again in the panel.
2. In **Teach**, choose three comfortable, different hand shapes for Next,
   Previous and Neutral. For example, try one finger, two fingers and an open
   palm. Use the same hand throughout and keep only one hand in view.
3. Hold the requested pose and click **Record clip**. Record three clips for
   each pose, relaxing and slightly repositioning your hand between clips.
4. In **Calibrate**, follow the five on-screen captures. This checks whether
   GestureBridge can tell your poses apart. If it asks you to retry, use more
   distinct finger shapes and retake the relevant pose. Changing only your
   hand's sideways angle will not make a different command.

## Use it with your Google Slides

1. Keep your Slides presentation open in the same Chrome window as the panel.
2. In **Present**, click **Open slideshow**. Wait for it to load, then click
   **Connect Slides tab**.
3. Click **Start gesture controls**.
4. Hold **Neutral** for 0.4 seconds to get ready. Hold **Next** or **Previous**
   for 0.5 seconds to move one slide.
5. Return to **Neutral** before each new command. Holding Next or Previous
   continuously moves only one slide.
6. Click **Pause controls** to pause. You can also press Escape while the panel
   has focus. Closing or hiding the panel pauses controls; closing it also stops
   the camera.

Keep the panel visible while presenting. Start with a short presentation without
animations and try moving forward and backward before using it for an audience.
Fullscreen, presenter view and animations still need testing. Published Slides
links and speaker-notes windows are not supported.

Your taught poses save on this computer. Wait for **Poses saved** before closing
the panel. When you reopen it, start the camera, repeat **Calibrate**, reconnect
Slides and start controls again. **Retake** replaces one pose; **Reset setup**
deletes all saved poses. Removing the extension also deletes them.

## If something does not work

- **Camera will not start:** allow camera access in the setup tab, then return to
  the panel and click **Start camera** again.
- **Slides do not move:** return to the Slides tab, click the GestureBridge
  toolbar icon there, reconnect and start controls again. Hold Neutral first.
  Reaching the first or last slide can also pause controls.
- **Gestures get confused:** keep one hand clearly visible and use different
  finger shapes. Retake the affected poses and repeat Calibrate. Unfamiliar
  poses can sometimes be mistaken for taught ones.

Camera images are processed on your computer and are not recorded or uploaded by
GestureBridge. The extension saves pose measurements locally, without cloud sync.
See the [extension guide](extension/README.md) for permissions and testing details.

## Run or develop the web demo

After `npm install`, run `npm run dev` and open the local address it prints.
The web demo controls its own presentation, and reloading clears its taught poses.

- `npm test` runs automated checks.
- `npm run build` builds the web demo.
- `npm run build:extension` builds the extension and a ZIP in `releases/`.
- `npm run format:check` checks formatting.

For code details, see the [project guide](docs/README.md).
