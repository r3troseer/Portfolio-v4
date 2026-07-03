import { useState } from "react";
import Markdown from "react-markdown";
import { GalleryItem } from "./GalleryItem";
import { Modal } from "./Modal";
import { PencilRuler, Lightbulb, Images } from "lucide-react";

const iconByType = {
  Architecture: <PencilRuler size={18} />,
  Features: <Lightbulb size={18} />,
};

export const ContentCard = ({ markdown, type, tags, gallery, children }) => {
  const [modalData, setModalData] = useState(null);
  const [failedCount, setFailedCount] = useState(0);
  // Hide the whole media block (incl. its title) once every image has failed.
  const galleryVisible = gallery && failedCount < gallery.images.length;

  return (
    <div className="pf-pd-card">
      {markdown && (
        <div className="md-render">
          <Markdown
            components={{
              h3: ({ node, ...props }) => (
                <h3 {...props}>
                  {iconByType[type] || null}
                  {props.children}
                </h3>
              ),
            }}
          >
            {markdown}
          </Markdown>
        </div>
      )}

      {tags && (
        <div className="pf-pd-card-tags">
          {tags.map((tag, i) => (
            <span className="pf-pd-stack" key={i}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {galleryVisible && (
        <div className="pf-pd-media">
          <span className="pf-pd-media-title">
            <Images size={13} /> {gallery.title || "Gallery"}
          </span>
          <div className="pf-pd-media-grid">
            {gallery.images.map((img, i) => (
              <GalleryItem
                key={i}
                img={img}
                setModalData={setModalData}
                onFail={() => setFailedCount((c) => c + 1)}
              />
            ))}
          </div>
        </div>
      )}

      {children}

      {modalData && <Modal onClose={() => setModalData(null)} data={modalData} />}
    </div>
  );
};
