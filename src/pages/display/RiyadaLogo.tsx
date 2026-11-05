import baseUrl from "../../assets/riyada/base.png";
import flagUrl from "../../assets/riyada/flag.png";
import starUrl from "../../assets/riyada/star.png";

// شعار فريق ريادة التطوعي: ثلاث طبقات فوق بعض حتى يرفرف العلم وتلمع النجمة.
export function RiyadaLogo() {
  return (
    <div className="rb-logo" role="img" aria-label="فريق ريادة التطوعي">
      <div className="rb-logo-art">
        <img className="rb-logo-layer" src={baseUrl} alt="" draggable={false} />
        <img className="rb-logo-layer rb-logo-flag" src={flagUrl} alt="" draggable={false} />
        <img className="rb-logo-layer rb-logo-star" src={starUrl} alt="" draggable={false} />
        {/* اللمعة محصورة داخل شكل الشعار نفسه */}
        <span
          className="rb-logo-shine-mask"
          aria-hidden="true"
          style={{ WebkitMaskImage: `url(${baseUrl})`, maskImage: `url(${baseUrl})` }}
        >
          <span className="rb-logo-shine" />
        </span>
      </div>
    </div>
  );
}
