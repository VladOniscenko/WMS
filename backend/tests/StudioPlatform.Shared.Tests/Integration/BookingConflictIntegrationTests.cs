using System.Net;
using System.Net.Http.Json;
using StudioPlatform.Modules.Agenda;
using StudioPlatform.Modules.Employees;
using Xunit;

namespace StudioPlatform.Shared.Tests.Integration;

public sealed class BookingConflictIntegrationTests : IClassFixture<StudioPlatformApiFactory>
{
    private readonly StudioPlatformApiFactory _factory;

    public BookingConflictIntegrationTests(StudioPlatformApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task DuplicateBooking_ExactSameSlot_ReturnsConflict409()
    {
        var businessId = Guid.NewGuid();
        var websiteId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "BusinessAdmin");

        // 1. Create employee and schedule
        var employee = new EmployeeProfile
        {
            DisplayName = "Maya Nail Artist",
            Email = "maya@nails.test",
            AssignedWebsiteIds = [websiteId],
            IsActive = true
        };
        var empRes = await client.PostAsJsonAsync("/api/employees", employee);
        var createdEmp = await empRes.Content.ReadFromJsonAsync<EmployeeProfile>();
        var employeeId = createdEmp!.Id;

        var targetDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3));
        await client.PutAsJsonAsync($"/api/employees/{employeeId}/schedule", new EmployeeWeeklySchedule
        {
            EmployeeId = employeeId,
            WebsiteId = websiteId,
            Windows =
            [
                new ScheduleWindow
                {
                    Day = targetDate.DayOfWeek,
                    StartTime = new TimeOnly(10, 0),
                    EndTime = new TimeOnly(16, 0)
                }
            ]
        });

        // 2. First booking
        var slotStart = targetDate.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc);
        var slotEnd = targetDate.ToDateTime(new TimeOnly(11, 0), DateTimeKind.Utc);

        var firstBooking = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = slotStart,
            EndAtUtc = slotEnd,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Manicure", DurationMinutes = 60, Price = 50m }
        };

        var firstResponse = await client.PostAsJsonAsync("/api/agenda/reservations", firstBooking);
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // 3. Duplicate booking attempt for the exact same slot
        var secondBooking = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = slotStart,
            EndAtUtc = slotEnd,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Manicure", DurationMinutes = 60, Price = 50m }
        };

        var secondResponse = await client.PostAsJsonAsync("/api/agenda/reservations", secondBooking);
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task OverlappingBooking_PartialOverlap_ReturnsConflict409()
    {
        var businessId = Guid.NewGuid();
        var websiteId = Guid.NewGuid();
        var client = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "BusinessAdmin");

        // Create employee and schedule
        var employee = new EmployeeProfile
        {
            DisplayName = "Elena Nail Tech",
            Email = "elena@nails.test",
            AssignedWebsiteIds = [websiteId],
            IsActive = true
        };
        var empRes = await client.PostAsJsonAsync("/api/employees", employee);
        var createdEmp = await empRes.Content.ReadFromJsonAsync<EmployeeProfile>();
        var employeeId = createdEmp!.Id;

        var targetDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(4));
        await client.PutAsJsonAsync($"/api/employees/{employeeId}/schedule", new EmployeeWeeklySchedule
        {
            EmployeeId = employeeId,
            WebsiteId = websiteId,
            Windows =
            [
                new ScheduleWindow
                {
                    Day = targetDate.DayOfWeek,
                    StartTime = new TimeOnly(9, 0),
                    EndTime = new TimeOnly(17, 0)
                }
            ]
        });

        // First reservation: 10:00 to 11:00
        var start1 = targetDate.ToDateTime(new TimeOnly(10, 0), DateTimeKind.Utc);
        var end1 = targetDate.ToDateTime(new TimeOnly(11, 0), DateTimeKind.Utc);
        var firstBooking = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = start1,
            EndAtUtc = end1,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Nail Art", DurationMinutes = 60, Price = 60m }
        };
        var res1 = await client.PostAsJsonAsync("/api/agenda/reservations", firstBooking);
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);

        // Overlapping reservation: 10:30 to 11:30
        var start2 = targetDate.ToDateTime(new TimeOnly(10, 30), DateTimeKind.Utc);
        var end2 = targetDate.ToDateTime(new TimeOnly(11, 30), DateTimeKind.Utc);
        var overlappingBooking = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = start2,
            EndAtUtc = end2,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Express Pedicure", DurationMinutes = 60, Price = 55m }
        };
        var res2 = await client.PostAsJsonAsync("/api/agenda/reservations", overlappingBooking);
        Assert.Equal(HttpStatusCode.Conflict, res2.StatusCode);
    }

    [Fact]
    public async Task ConcurrentBooking_SameSlot_OnlyOneSucceeds()
    {
        var businessId = Guid.NewGuid();
        var websiteId = Guid.NewGuid();
        var client1 = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "BusinessAdmin");
        var client2 = _factory.CreateAuthenticatedClient(businessId, websiteId, role: "BusinessAdmin");

        var employee = new EmployeeProfile
        {
            DisplayName = "Zoe Nail Artist",
            Email = "zoe@nails.test",
            AssignedWebsiteIds = [websiteId],
            IsActive = true
        };
        var empRes = await client1.PostAsJsonAsync("/api/employees", employee);
        var createdEmp = await empRes.Content.ReadFromJsonAsync<EmployeeProfile>();
        var employeeId = createdEmp!.Id;

        var targetDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5));
        await client1.PutAsJsonAsync($"/api/employees/{employeeId}/schedule", new EmployeeWeeklySchedule
        {
            EmployeeId = employeeId,
            WebsiteId = websiteId,
            Windows =
            [
                new ScheduleWindow
                {
                    Day = targetDate.DayOfWeek,
                    StartTime = new TimeOnly(13, 0),
                    EndTime = new TimeOnly(17, 0)
                }
            ]
        });

        var slotStart = targetDate.ToDateTime(new TimeOnly(14, 0), DateTimeKind.Utc);
        var slotEnd = targetDate.ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc);

        var booking1 = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = slotStart,
            EndAtUtc = slotEnd,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Gel Nails", DurationMinutes = 60, Price = 50m }
        };

        var booking2 = new Reservation
        {
            ResourceId = employeeId,
            ClientId = Guid.NewGuid(),
            StartAtUtc = slotStart,
            EndAtUtc = slotEnd,
            Status = nameof(ReservationStatus.Pending),
            ServiceSnapshot = new ServiceSnapshot { ServiceName = "Gel Nails", DurationMinutes = 60, Price = 50m }
        };

        // Fire both concurrently
        var task1 = client1.PostAsJsonAsync("/api/agenda/reservations", booking1);
        var task2 = client2.PostAsJsonAsync("/api/agenda/reservations", booking2);

        var responses = await Task.WhenAll(task1, task2);
        var statusCodes = responses.Select(r => r.StatusCode).ToList();

        Assert.Contains(HttpStatusCode.Created, statusCodes);
        Assert.Contains(HttpStatusCode.Conflict, statusCodes);
    }
}

