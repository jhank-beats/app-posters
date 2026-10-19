import { useState } from "react";

const Carrusel = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex + 1 === images.length ? 0 : prevIndex + 1
    );
  };
  const handlePrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex - 1 < 0 ? images.length - 1 : prevIndex - 1
    );
  };
  const handleDotClick = (index) => {
    setCurrentIndex(index);
  };
    return (
    <div className="carousel">
    <img
        key={currentIndex}
        src={images[currentIndex]}
        alt={`slide-${currentIndex}`}
        loading="lazy"
        decoding="async"
    />
    <div className="slide_direction">
        <div className="left" onClick={handlePrevious}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M73.4 297.4C60.9 309.9 60.9 330.2 73.4 342.7L233.4 502.7C245.9 515.2 266.2 515.2 278.7 502.7C291.2 490.2 291.2 469.9 278.7 457.4L173.3 352L544 352C561.7 352 576 337.7 576 320C576 302.3 561.7 288 544 288L173.3 288L278.7 182.6C291.2 170.1 291.2 149.8 278.7 137.3C266.2 124.8 245.9 124.8 233.4 137.3L73.4 297.3z"/></svg>
        </div>
        <div className="right" onClick={handleNext}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.7C373.8 515.2 394.1 515.2 406.6 502.7L566.6 342.7z"/></svg>
        </div>
    </div>

    {/* Indicadores corregidos */}
    <div className="carousel-indicator">
        {images.map((_, index) => (
        <div
            key={index}
            className={`dot ${currentIndex === index ? "active" : ""}`}
            onClick={() => handleDotClick(index)}
        ></div>
        ))}
    </div>
    </div>

  );
}

export default Carrusel;
