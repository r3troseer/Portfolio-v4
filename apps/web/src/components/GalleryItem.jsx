// import { Images } from "lucide-react";
export const GalleryItem = ({ img, setModalData }) => {
  return (
    <div
      className="gallery-item"
      onClick={() => {
        setModalData(img);
      }}
    >
      <img src={img.src} alt={img.title} />
      <div className="gallery-overlay">
        <div className="gallery-overlay-title">{img.title}</div>
      </div>
    </div>
  );
};

// fix
