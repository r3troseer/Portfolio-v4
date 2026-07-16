import { useState } from "react";
import { GalleryItem } from "./GalleryItem";
import { Modal } from "./Modal";
import { PencilRuler, Lightbulb, Images } from "lucide-react";

const iconByType = {
  Architecture: <PencilRuler size={18} />,
  Features: <Lightbulb size={18} />,
};

const renderSpans = (spans = []) =>
  spans.map((span, i) => {
    let node = span.text;
    if (span.code) {
      node = <code key={i}>{span.text}</code>;
    } else if (span.bold) {
      node = <strong key={i}>{span.text}</strong>;
    } else if (span.italic) {
      node = <em key={i}>{span.text}</em>;
    } else {
      node = <span key={i}>{span.text}</span>;
    }
    return node;
  });

const ListBlock = ({ items }) => (
  <ul>
    {items.map((item, i) => (
      <li key={i}>
        {renderSpans(item.spans)}
        {item.items?.length > 0 && <ListBlock items={item.items} />}
      </li>
    ))}
  </ul>
);

const renderBlocks = (blocks = []) =>
  blocks.map((block, i) => {
    if (block.type === "paragraph") {
      return <p key={i}>{renderSpans(block.spans)}</p>;
    }
    if (block.type === "list") {
      return <ListBlock key={i} items={block.items} />;
    }
    if (block.type === "subsection") {
      return (
        <div key={i} className="pf-pd-card-subsection">
          <p className="pf-pd-card-subtitle">{block.title}</p>
          {renderBlocks(block.blocks)}
        </div>
      );
    }
    return null;
  });

export const ContentCard = ({ title, type, blocks, tags, gallery, children }) => {
  const [modalData, setModalData] = useState(null);
  const [failedCount, setFailedCount] = useState(0);
  // Hide the whole media block (incl. its title) once every image has failed.
  const galleryVisible = gallery && failedCount < gallery.images.length;

  return (
    <div className="pf-pd-card">
      {title && (
        <h2 className="pf-pd-card-title">
          {iconByType[type] || null}
          {title}
        </h2>
      )}

      {blocks?.length > 0 && (
        <div className="pf-pd-card-body">{renderBlocks(blocks)}</div>
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
