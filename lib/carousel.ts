type CarouselTrack = {
  clientWidth: number;
  scrollLeft: number;
  scrollTo?: (options: ScrollToOptions) => void;
};

export function scrollCarouselTo(track: CarouselTrack | null, index: number) {
  if (!track) return;
  const left = track.clientWidth * index;
  if (typeof track.scrollTo === "function") track.scrollTo({ left, behavior: "smooth" });
  else track.scrollLeft = left;
}
