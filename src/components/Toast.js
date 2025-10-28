import React from "react";
import ReactDOM from "react-dom";
import "./Toast.css";

const Toast = ({ type = "info", message, onClose, duration = 3000 }) => {
  React.useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return ReactDOM.createPortal(
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-content">{message}</div>
      <button className="toast-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>,
    document.body
  );
};

export default Toast;
