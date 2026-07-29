type CarouselTrack = {
  clientWidth: number;
  scrollLeft: number;
  scrollTo?: (options: ScrollToOptions) => void;
};

export function carouselIndexFromPosition(clientWidth: number, scrollLeft: number) {
  if (clientWidth <= 0) return null;
  return Math.round(scrollLeft / clientWidth);
}

export function nextCarouselIndex(currentIndex: number, slideCount: number) {
  if (slideCount <= 1) return 0;
  return (currentIndex + 1) % slideCount;
}

export function scrollCarouselTo(track: CarouselTrack | null, index: number) {
  if (!track) return;
  const left = track.clientWidth * index;
  if (typeof track.scrollTo === "function") track.scrollTo({ left, behavior: "smooth" });
  else track.scrollLeft = left;
}
