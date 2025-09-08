import { useState } from "react";
import Markdown from "react-markdown";
// import "../styles/content-card.css";
import { GalleryItem } from "./GalleryItem";
import { TechTags } from "./TechTags";
import { Modal } from "./Modal";
import { PencilRuler, Lightbulb, Images } from "lucide-react";
import { ContentType } from "../data/projects";

export const ContentCard = ({ markdown, type, tags, gallery, children }) => {
  const [modalData, setModalData] = useState(null);

  const iconMap = {
    [ContentType.Architecture]: <PencilRuler className="icon" />,
    [ContentType.Features]: <Lightbulb className="icon" />,
  };
  return (
    <div className="content-card">
      {/* add icon to markdown title */}
      {markdown && (
        <Markdown
          components={{
            h3: ({ node, ...props }) => {
              //   const text = String(props.children);
              const icon = iconMap[type] || null;
              return (
                <h3 {...props}>
                  {icon}
                  {props.children}
                </h3>
              );
            },
          }}
        >
          {markdown}
        </Markdown>
      )}
      {/* Tags */}
      {tags && <TechTags tags={tags} />}
      {/* Gallery items */}
      {gallery && (
        <div className="inline-gallery">
          <div className="gallery-title">
            <Images /> {/*add class or use iconNode*/}
            {gallery.title || "Gallery"}
          </div>
          <div className="gallery-grid">
            {gallery.images.map((img, i) => (
              <GalleryItem key={i} img={img} setModalData={setModalData} />
            ))}
          </div>
        </div>
      )}
      {children}
      {/* Modal */}
      {modalData && (
        <Modal onClose={() => setModalData(null)} data={modalData} />
      )}
    </div>
  );
};
