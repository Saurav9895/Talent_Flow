import React from "react";
import "../styles/shared.css";

const Card = ({
  title,
  subtitle,
  children,
  footer,
  onClick,
  className = "",
  isDragging = false,
}) => {
  return (
    <div
      className={`card ${className} ${isDragging ? "card-dragging" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      )}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};

export default Card;
