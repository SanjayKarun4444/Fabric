const notifier = require('node-notifier');
const path = require('path');

function showNotification(title, body, options = {}) {
  const iconPath = path.join(__dirname, '../../assets/icon.png');

  notifier.notify({
    title: title,
    message: body,
    icon: iconPath,
    sound: options.sound !== false, // true by default
    wait: options.wait || false,
    timeout: options.timeout || 5,
    urgency: options.urgency || 'normal', // low, normal, critical
    ...options,
  });

  // Handle notification click
  notifier.on('click', (notifierObject, options, event) => {
    if (options.onClick) {
      options.onClick();
    }
  });

  // Handle notification timeout
  notifier.on('timeout', (notifierObject, options) => {
    if (options.onTimeout) {
      options.onTimeout();
    }
  });
}

function showActionNotification(title, body, actions, onAction) {
  // For macOS, we can show action buttons
  if (process.platform === 'darwin') {
    notifier.notify({
      title: title,
      message: body,
      icon: path.join(__dirname, '../../assets/icon.png'),
      sound: true,
      wait: true,
      actions: actions, // Array of button labels
    });

    notifier.on('click', (notifierObject, options, event) => {
      if (event && onAction) {
        onAction(event);
      }
    });
  } else {
    // Fallback for Windows/Linux
    showNotification(title, body);
  }
}

module.exports = { showNotification, showActionNotification };
