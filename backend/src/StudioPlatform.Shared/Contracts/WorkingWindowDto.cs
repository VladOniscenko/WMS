namespace StudioPlatform.Shared.Contracts;

public sealed record WorkingWindowDto(
    DayOfWeek Day,
    TimeOnly StartTime,
    TimeOnly EndTime);
