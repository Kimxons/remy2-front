import React from "react";
import "./Slide.scss";

const Slide = ({ children, slidesToShow = 1 }) => {
  const normalizedSlidesToShow = Number(slidesToShow) > 0 ? Number(slidesToShow) : 1;
  const itemMinWidth = `calc((100% - ${(normalizedSlidesToShow - 1) * 16}px) / ${normalizedSlidesToShow})`;

  return (
    <div className="slide">
      <div className="container">
        <div className="slide__track">
          {React.Children.map(children, (child, index) => (
            <div className="slide__item" style={{ minWidth: itemMinWidth }} key={index}>
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Slide;
