"use client";

const STEPS = ["Input Data", "Bulk Queue", "Preview Changes", "Execution"];

interface Props {
  currentStep: number; // 0-indexed
}

export default function StepNav({ currentStep }: Props) {
  return (
    <nav
      className="bg-white border-b border-gray-200 sticky top-0 z-40"
      aria-label="Workflow steps"
    >
      <div className="max-w-screen-xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-center">
        <div className="flex items-center">
          {STEPS.map((label, idx) => {
            const done = idx < currentStep;
            const active = idx === currentStep;

            return (
              <div key={idx} className="flex items-center">
                {/* Connecting line before this step */}
                {idx > 0 && (
                  <div
                    className={`w-12 sm:w-20 h-0.5 mb-0 sm:mb-5 mx-1 transition-colors duration-300 ${
                      done ? "bg-[#0696D7]" : "bg-gray-200"
                    }`}
                  />
                )}

                {/* Step circle + label */}
                <div className="flex flex-col items-center">
                  <div
                    aria-label={`Step ${idx + 1}: ${label}`}
                    aria-current={active ? "step" : undefined}
                    className={`
                      w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 flex items-center justify-center
                      text-sm font-semibold transition-all select-none
                      ${active ? "bg-[#0696D7] border-[#0696D7] text-white" : ""}
                      ${done ? "bg-white border-[#0696D7] text-[#0696D7]" : ""}
                      ${!active && !done ? "bg-white border-gray-300 text-gray-400" : ""}
                    `}
                  >
                    {idx + 1}
                  </div>
                  <span
                    className={`text-xs mt-2 whitespace-nowrap hidden sm:block sm:text-sm ${
                      active ? "text-[#0696D7] font-semibold" : "text-gray-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
