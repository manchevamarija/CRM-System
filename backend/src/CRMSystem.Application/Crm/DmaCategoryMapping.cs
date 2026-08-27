namespace CRMSystem.Application;

public static class DmaCategoryMapping
{
    public static readonly string[] Values =
    [
        "DIGITAL_BUSINESS_STRATEGY",
        "DIGITAL_READINESS",
        "HUMAN_CENTRIC_DIGITALISATION",
        "DATA_MANAGEMENT",
        "AUTOMATION_AND_INTELLIGENCE",
        "GREEN_DIGITALISATION",
    ];

    public static bool IsValid(string? value) =>
        value is not null && Values.Contains(value, StringComparer.Ordinal);

    public static string Resolve(ContactRequestDto request)
    {
        if (!string.IsNullOrWhiteSpace(request.DmaCategory))
        {
            if (!IsValid(request.DmaCategory))
                throw new ArgumentException("Unsupported internal DMA category.");
            return request.DmaCategory;
        }

        if (
            !string.IsNullOrWhiteSpace(request.CurrentDataSources)
            || !string.IsNullOrWhiteSpace(request.PrivacyConcerns)
        )
            return "DATA_MANAGEMENT";
        if (request.UsesAi == true || request.MainNeed is "AI_USE_CASE" or "AI_ACT_COMPLIANCE")
            return "AUTOMATION_AND_INTELLIGENCE";
        return request.MainNeed switch
        {
            "FUNDING_AND_INVESTMENT" => "DIGITAL_BUSINESS_STRATEGY",
            "TRAINING_AND_SKILLS" => "HUMAN_CENTRIC_DIGITALISATION",
            "AUTOMATION_AND_INTELLIGENCE" => "AUTOMATION_AND_INTELLIGENCE",
            _ => "DIGITAL_READINESS",
        };
    }
}
